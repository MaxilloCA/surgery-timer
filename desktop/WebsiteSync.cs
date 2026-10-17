using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SurgeryTimer {
 public sealed class NameDialog : Form {
  readonly TextBox field=new TextBox(); public string AnesthetistName {get{return field.Text.Trim();}}
  public NameDialog() {
   Text="Start a new surgery day";ClientSize=new Size(330,124);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;MinimizeBox=false;StartPosition=FormStartPosition.CenterScreen;ShowInTaskbar=false;TopMost=true;
   Controls.Add(new Label {Text="Anesthetist name (shown in website history)",AutoSize=true,Location=new Point(12,12)});
   field.Location=new Point(12,36);field.Width=305;field.MaxLength=120;Controls.Add(field);
   var start=new Button {Text="Start surgery",Location=new Point(120,78),Size=new Size(100,28)};start.Click+=delegate{if(AnesthetistName.Length==0){field.Focus();return;}DialogResult=DialogResult.OK;Close();};Controls.Add(start);
   var cancel=new Button {Text="Cancel",Location=new Point(230,78),Size=new Size(87,28),DialogResult=DialogResult.Cancel};Controls.Add(cancel);AcceptButton=start;CancelButton=cancel;
  }
 }
 public interface ISyncTransport {string Post(string path,string json);}
 public sealed class HttpTransport : ISyncTransport {
  public string Post(string path,string json) {
   ServicePointManager.SecurityProtocol=(SecurityProtocolType)3072;
   var request=(HttpWebRequest)WebRequest.Create(SyncEngine.BaseUrl+path);request.Method="POST";request.ContentType="application/json";request.Timeout=15000;request.ReadWriteTimeout=15000;request.AllowAutoRedirect=false;
   byte[] data=Encoding.UTF8.GetBytes(json);request.ContentLength=data.Length;
   using(var output=request.GetRequestStream())output.Write(data,0,data.Length);
   using(var response=(HttpWebResponse)request.GetResponse()) {
    if((int)response.StatusCode<200 || (int)response.StatusCode>=300)throw new IOException("Website returned "+(int)response.StatusCode);
    using(var input=new StreamReader(response.GetResponseStream()))return input.ReadToEnd();
   }
  }
 }
 public sealed class SyncResult {public Dictionary<string,string> Acknowledged=new Dictionary<string,string>();public string Error;}
 public static class SyncEngine {
  public const string BaseUrl="https://surgery-timer.vercel.app";
  static string Fingerprint(string json) {using(var hash=SHA256.Create())return Convert.ToBase64String(hash.ComputeHash(Encoding.UTF8.GetBytes(json)));}
  static bool Send(TimerState snapshot,SyncResult result,ISyncTransport transport,string key,string path,string id,Dictionary<string,object> body) {
   var serializer=new JavaScriptSerializer();string json=serializer.Serialize(body),fingerprint=Fingerprint(json),ack;
   if(snapshot.Acknowledged.TryGetValue(key,out ack) && ack==fingerprint)return true;
   var response=serializer.Deserialize<Dictionary<string,object>>(transport.Post(path,json));
   if(response==null || !response.ContainsKey("id") || !String.Equals(response["id"] as string,id,StringComparison.OrdinalIgnoreCase))throw new IOException("Website did not acknowledge the expected record. Will retry safely.");
   result.Acknowledged[key]=fingerprint;return true;
  }
  public static SyncResult Run(TimerState snapshot,ISyncTransport transport) {
   var result=new SyncResult();
   try {foreach(var session in snapshot.Sessions) {
    if(String.IsNullOrWhiteSpace(session.AnesthetistName))throw new InvalidDataException("A saved session has no anesthetist name and cannot be uploaded.");
    Send(snapshot,result,transport,"session:"+session.Id,"/api/sessions",session.Id,new Dictionary<string,object>{{"clientGeneratedId",session.Id},{"anesthetistName",session.AnesthetistName},{"date",session.Date}});
    foreach(var c in session.Cases) {
     var body=new Dictionary<string,object>{{"clientGeneratedId",c.Id},{"sessionId",session.Id},{"caseNumber",c.Number},{"surgeryStart",Store.Stamp(c.Start)}};
     if(c.End.HasValue){body["surgeryEnd"]=Store.Stamp(c.End);body["surgeryDurationSec"]=TimerState.Seconds(c.Start,c.End.Value);}
     if(c.TurnoverStarted)body["turnoverStart"]=Store.Stamp(c.End);
     if(c.TurnoverEnd.HasValue){body["turnoverEnd"]=Store.Stamp(c.TurnoverEnd);body["turnoverDurationSec"]=TimerState.Seconds(c.End.Value,c.TurnoverEnd.Value);}
     Send(snapshot,result,transport,"case:"+c.Id,"/api/cases",c.Id,body);
    }
   }}catch(Exception e){result.Error=e.Message;}
   return result;
  }
 }
 public static class SyncTests {
  sealed class FakeTransport : ISyncTransport {
   public int Calls;public int FailAt;public bool WrongId;public bool LoseResponse;public HashSet<string> Accepted=new HashSet<string>();public readonly List<string> Paths=new List<string>();public readonly List<string> Bodies=new List<string>();
   public string Post(string path,string json) {Calls++;Paths.Add(path);Bodies.Add(json);if(Calls==FailAt)throw new IOException("Simulated offline");var body=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(json);Accepted.Add((string)body["clientGeneratedId"]);if(LoseResponse){LoseResponse=false;throw new IOException("Simulated lost response after server write");}return new JavaScriptSerializer().Serialize(new Dictionary<string,object>{{"id",WrongId?"wrong":body["clientGeneratedId"]}});}
  }
  static void Merge(TimerState state,SyncResult result){foreach(var pair in result.Acknowledged)state.Acknowledged[pair.Key]=pair.Value;}
  public static void Run(TimerState original) {
   var s=Store.Copy(original);var fake=new FakeTransport();var result=SyncEngine.Run(s,fake);Tests.Check(result.Error==null && fake.Calls==5,"sync all sessions and cases");Tests.Check(fake.Paths[0]=="/api/sessions" && fake.Paths[1]=="/api/cases","session before case");Tests.Check(fake.Bodies[1].Contains("turnoverStart") && !fake.Bodies[2].Contains("turnoverStart"),"only actual turnover uploaded");Merge(s,result);
   fake=new FakeTransport();result=SyncEngine.Run(s,fake);Tests.Check(fake.Calls==0,"acknowledged history not re-uploaded");
   var next=Store.Copy(original);fake=new FakeTransport {FailAt=3};result=SyncEngine.Run(next,fake);Tests.Check(result.Error!=null && result.Acknowledged.Count==2,"partial failure retains acknowledgments");Merge(next,result);fake=new FakeTransport();result=SyncEngine.Run(next,fake);Tests.Check(result.Error==null && fake.Calls==3,"retry only pending records");
   fake=new FakeTransport {WrongId=true};result=SyncEngine.Run(Store.Copy(original),fake);Tests.Check(result.Error!=null && result.Acknowledged.Count==0,"wrong identity never acknowledged");
   long t=new DateTime(2026,10,17,12,0,0,DateTimeKind.Utc).Ticks;
   var active=new TimerState();active.Apply(1,t,"Test name");var inflight=Store.Copy(active);fake=new FakeTransport();result=SyncEngine.Run(inflight,fake);
   active.Apply(2,t+60*TimeSpan.TicksPerSecond);Merge(active,result);fake=new FakeTransport();result=SyncEngine.Run(active,fake);Tests.Check(active.Phase=="turnover" && active.CurrentCase.End.HasValue && fake.Calls==1 && fake.Paths[0]=="/api/cases" && fake.Bodies[0].Contains("surgeryDurationSec"),"inflight acknowledgment preserves newer transition and resends changed case only");
   next=new TimerState();next.Apply(1,t,"Test name");fake=new FakeTransport {LoseResponse=true};result=SyncEngine.Run(next,fake);Tests.Check(result.Error!=null && result.Acknowledged.Count==0 && fake.Accepted.Count==1,"lost response after server write");string firstBody=fake.Bodies[0];result=SyncEngine.Run(next,fake);Tests.Check(result.Error==null && fake.Bodies[1]==firstBody && fake.Accepted.Count==2,"lost response retries identical ID and payload without duplicate identity");
   next=Store.Copy(original);next.Sessions[0].AnesthetistName=null;fake=new FakeTransport();result=SyncEngine.Run(next,fake);Tests.Check(result.Error!=null && fake.Calls==0,"missing name not uploaded");
  }
 }
}
