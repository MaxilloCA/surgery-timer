using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Net;
using System.Security.Cryptography;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SurgeryTimer {
 public sealed class CaseRecord {
  public string Id {get;set;} public int Number {get;set;}
  public bool TurnoverStarted {get;set;}
  public long Start {get;set;} public long? End {get;set;} public long? TurnoverEnd {get;set;}
 }
 public sealed class SessionRecord {
  public string AnesthetistName {get;set;} public string Id {get;set;} public string Date {get;set;} public long? End {get;set;}
  public List<CaseRecord> Cases {get;set;}
 }
 public sealed class TimerState {
  public int Version {get;set;} public string Phase {get;set;}
  public Dictionary<string,string> Acknowledged {get;set;}
  public List<SessionRecord> Sessions {get;set;}
  public TimerState() {Version=1; Phase="idle"; Acknowledged=new Dictionary<string,string>(); Sessions=new List<SessionRecord>();}
  [ScriptIgnore] public SessionRecord CurrentSession {get {return Sessions.Count==0 || Sessions[Sessions.Count-1].End.HasValue ? null : Sessions[Sessions.Count-1];}}
  [ScriptIgnore] public CaseRecord CurrentCase {get {var s=CurrentSession; return s==null || s.Cases.Count==0 ? null : s.Cases[s.Cases.Count-1];}}
  public bool Apply(int action,long now) {return Apply(action,now,"Test anesthetist");}
  public bool Apply(int action,long now,string anesthetistName) {
   now-=now%TimeSpan.TicksPerMillisecond;
   if(action==1) {
    if(Phase=="surgery")return false;
    var s=CurrentSession;
    if(s==null) {s=new SessionRecord {AnesthetistName=anesthetistName,Id=Guid.NewGuid().ToString(),Date=new DateTime(now,DateTimeKind.Utc).ToLocalTime().ToString("yyyy-MM-dd"),Cases=new List<CaseRecord>()};Sessions.Add(s);}
    if(Phase=="turnover")CurrentCase.TurnoverEnd=Math.Max(now,CurrentCase.End.Value);
    s.Cases.Add(new CaseRecord {Id=Guid.NewGuid().ToString(),Number=s.Cases.Count+1,Start=now}); Phase="surgery";return true;
   }
   if(action==2 && Phase=="surgery") {CurrentCase.End=Math.Max(now,CurrentCase.Start);CurrentCase.TurnoverStarted=true;Phase="turnover";return true;}
   if(action==3 && CurrentSession!=null) {
    var c=CurrentCase;
    if(Phase=="surgery")c.End=Math.Max(now,c.Start);
    if(Phase=="turnover")c.TurnoverEnd=Math.Max(now,c.End.Value);
    CurrentSession.End=Math.Max(now,c.End.Value);Phase="idle";return true;
   }
   return false;
  }
  public long SurgerySeconds(long now) {var c=CurrentCase;return c==null?0:Seconds(c.Start,c.End??now);}
  public long TurnoverSeconds(long now) {var c=CurrentCase;return c==null || !c.End.HasValue?0:Seconds(c.End.Value,c.TurnoverEnd??now);}
  public static long Seconds(long a,long b) {return Math.Max(0,(b-a)/TimeSpan.TicksPerSecond);}
 }
 public sealed class Store {
  public readonly string PathName; public string Warning;
  static JavaScriptSerializer Serializer() {return new JavaScriptSerializer {MaxJsonLength=int.MaxValue};}
  public Store(string directory) {Directory.CreateDirectory(directory);PathName=Path.Combine(directory,"timer-state.json");}
  public static TimerState Copy(TimerState s) {return Serializer().Deserialize<TimerState>(Serializer().Serialize(s));}
  static TimerState Read(string path) {
   var s=Serializer().Deserialize<TimerState>(File.ReadAllText(path));
   if(s==null || s.Version!=1 || s.Sessions==null || (s.Phase!="idle" && s.Phase!="surgery" && s.Phase!="turnover"))throw new InvalidDataException("Invalid state format.");
   for(int i=0;i<s.Sessions.Count;i++) {var session=s.Sessions[i];if(session==null || String.IsNullOrEmpty(session.Id) || session.Cases==null || session.Cases.Count==0 || (i<s.Sessions.Count-1 && !session.End.HasValue))throw new InvalidDataException("Invalid session.");foreach(var c in session.Cases)if(c==null || c.Start<=0 || (c.End.HasValue && c.End<c.Start) || (c.TurnoverEnd.HasValue && (!c.End.HasValue || c.TurnoverEnd<c.End)))throw new InvalidDataException("Invalid case.");}
   if((s.Phase=="idle" && s.CurrentSession!=null) || (s.Phase!="idle" && s.CurrentCase==null) || (s.Phase=="surgery" && s.CurrentCase.End.HasValue) || (s.Phase=="turnover" && (!s.CurrentCase.End.HasValue || s.CurrentCase.TurnoverEnd.HasValue)))throw new InvalidDataException("Invalid active phase.");
   if(s.Acknowledged==null)s.Acknowledged=new Dictionary<string,string>();return s;
  }
  public TimerState Load() {
   if(!File.Exists(PathName) && !File.Exists(PathName+".bak"))return new TimerState();
   try {return Read(PathName);} catch(Exception primary) {
    TimerState recovered;
    try {recovered=Read(PathName+".bak");}catch {throw new InvalidDataException("Timer data could not be read. Existing files were preserved at "+Path.GetDirectoryName(PathName)+". Restore a valid backup before restarting.",primary);}
    if(File.Exists(PathName))File.Move(PathName,PathName+".corrupt-"+Guid.NewGuid().ToString("N"));
    Warning="Recovered the previous saved state from backup. The most recent action may need checking. The damaged file was preserved.";Save(recovered);return recovered;
   }
  }
  public void Save(TimerState state) {
   string temp=PathName+"."+Guid.NewGuid().ToString("N")+".tmp";
   try {
    byte[] bytes=new UTF8Encoding(false).GetBytes(Serializer().Serialize(state));
    using(var stream=new FileStream(temp,FileMode.CreateNew,FileAccess.Write,FileShare.None)) {stream.Write(bytes,0,bytes.Length);stream.Flush(true);}
    if(File.Exists(PathName))File.Replace(temp,PathName,PathName+".bak");else File.Move(temp,PathName);
   }finally {if(File.Exists(temp))File.Delete(temp);}
  }
  public static string Stamp(long? tick) {return tick.HasValue?new DateTime(tick.Value,DateTimeKind.Utc).ToString("o",CultureInfo.InvariantCulture):"";}
  public static string Csv(TimerState state) {
   var b=new StringBuilder("SessionId,SessionDate,SessionEndUtc,CaseId,CaseNumber,SurgeryStartUtc,SurgeryEndUtc,SurgerySeconds,TurnoverEndUtc,TurnoverSeconds\r\n");
   foreach(var s in state.Sessions)foreach(var c in s.Cases)b.AppendFormat(CultureInfo.InvariantCulture,"{0},{1},{2},{3},{4},{5},{6},{7},{8},{9}\r\n",s.Id,s.Date,Stamp(s.End),c.Id,c.Number,Stamp(c.Start),Stamp(c.End),c.End.HasValue?TimerState.Seconds(c.Start,c.End.Value).ToString(CultureInfo.InvariantCulture):"",Stamp(c.TurnoverEnd),c.TurnoverEnd.HasValue?TimerState.Seconds(c.End.Value,c.TurnoverEnd.Value).ToString(CultureInfo.InvariantCulture):"");
   return b.ToString();
  }
 }
 public sealed class TimerWindow : Form {
  [DllImport("user32.dll",SetLastError=true)]static extern bool RegisterHotKey(IntPtr hwnd,int id,uint modifiers,uint key);
  [DllImport("user32.dll")]static extern bool UnregisterHotKey(IntPtr hwnd,int id);
  [DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr hwnd,int msg,IntPtr w,IntPtr l);
  readonly Store store; TimerState state; readonly NotifyIcon tray; readonly System.Windows.Forms.Timer clock;
  NameDialog activePicker;
  readonly Icon windowIcon; readonly Icon trayIcon;
  static Icon LoadIcon(Size size) {
   using(var stream=typeof(TimerWindow).Assembly.GetManifestResourceStream("ORTimer.ico")) {
    if(stream==null)throw new InvalidDataException("The timer icon is missing. Rebuild OR Timer.");
    using(var icon=new Icon(stream,size))return (Icon)icon.Clone();
   }
  }
  readonly List<int> registered=new List<int>(); readonly ContextMenuStrip menu=new ContextMenuStrip();
  readonly bool smoke; readonly BackgroundWorker syncWorker=new BackgroundWorker(); readonly ToolStripMenuItem syncStatus=new ToolStripMenuItem("Sync: waiting"); DateTime nextSync=DateTime.MinValue; bool prompting; bool syncAgain; Point dragOrigin; bool dragging; Font labelFont=new Font("Segoe UI",9f,FontStyle.Regular,GraphicsUnit.Pixel); Font timeFont=new Font("Consolas",18f,FontStyle.Bold,GraphicsUnit.Pixel);
  public TimerWindow(Store data,bool smokeTest) {
   store=data;state=store.Load();smoke=smokeTest;
   AutoScaleMode=AutoScaleMode.None; FormBorderStyle=FormBorderStyle.None; ClientSize=new Size(125,75);MinimumSize=MaximumSize=new Size(125,75);TopMost=true;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;BackColor=Color.FromArgb(23,29,34);DoubleBuffered=true;Text="OR Timer";
   windowIcon=LoadIcon(new Size(32,32));trayIcon=LoadIcon(SystemInformation.SmallIconSize);Icon=windowIcon;
   Location=new Point(Screen.PrimaryScreen.WorkingArea.Right-145,Screen.PrimaryScreen.WorkingArea.Top+20);
   menu.Items.Add("Start surgery   Ctrl+Shift+Alt+1",null,delegate{Act(1);});menu.Items.Add("End surgery   Ctrl+Shift+Alt+2",null,delegate{Act(2);});menu.Items.Add("End day   Ctrl+Shift+Alt+3",null,delegate{Act(3);});menu.Items.Add(new ToolStripSeparator());menu.Items.Add("Show timer",null,delegate{Show();Clamp();TopMost=true;});menu.Items.Add("Export history (CSV)...",null,delegate{Export();});menu.Items.Add("Open data folder",null,delegate{System.Diagnostics.Process.Start(Path.GetDirectoryName(store.PathName));});menu.Items.Add(new ToolStripSeparator());syncStatus.Enabled=false;menu.Items.Add(syncStatus);menu.Items.Add("Website sync details",null,delegate{MessageBox.Show(this,syncStatus.ToolTipText.Length==0?syncStatus.Text:syncStatus.ToolTipText,"Website history sync");});menu.Items.Add("Retry website sync now",null,delegate{BeginSync();});menu.Items.Add("Open website history",null,delegate{System.Diagnostics.Process.Start(SyncEngine.BaseUrl+"/history");});menu.Items.Add(new ToolStripSeparator());menu.Items.Add("Quit (keep timer running)",null,delegate{Close();});ContextMenuStrip=menu;
   tray=new NotifyIcon {Icon=trayIcon,Text="OR Timer - right-click for controls",ContextMenuStrip=menu,Visible=true};tray.DoubleClick+=delegate{Show();Clamp();};
   clock=new System.Windows.Forms.Timer {Interval=250};clock.Tick+=delegate {Invalidate();if(!smoke && DateTime.UtcNow>=nextSync)BeginSync();};clock.Start();
   MouseDown+=delegate(object sender,MouseEventArgs e){if(e.Button==MouseButtons.Left){dragging=true;dragOrigin=e.Location;Capture=true;}};
   MouseMove+=delegate(object sender,MouseEventArgs e){if(dragging){Location=new Point(Location.X+e.X-dragOrigin.X,Location.Y+e.Y-dragOrigin.Y);Clamp();}};
   MouseUp+=delegate{dragging=false;Capture=false;};
   syncWorker.DoWork+=delegate(object sender,DoWorkEventArgs e){e.Result=SyncEngine.Run((TimerState)e.Argument,new HttpTransport());};
   syncWorker.RunWorkerCompleted+=delegate(object sender,RunWorkerCompletedEventArgs e){
    if(IsDisposed)return;
    if(e.Error!=null){syncStatus.Text="Sync: offline / retry pending";nextSync=DateTime.UtcNow.AddSeconds(30);return;}
    var result=(SyncResult)e.Result;
    try {var updated=Store.Copy(state);foreach(var pair in result.Acknowledged)updated.Acknowledged[pair.Key]=pair.Value;if(result.Acknowledged.Count>0){store.Save(updated);state=updated;}syncStatus.Text=result.Error==null?"Sync: history saved to website":"Sync: retry pending (see details)";syncStatus.ToolTipText=result.Error??"All saved records uploaded.";}
    catch(Exception error){syncStatus.Text="Sync: local save failed / retry pending";syncStatus.ToolTipText=error.Message;}
    nextSync=DateTime.UtcNow.AddSeconds(30);if(syncAgain){syncAgain=false;BeginSync();}
   };
   Microsoft.Win32.SystemEvents.DisplaySettingsChanged+=DisplayChanged;
  }
  void DisplayChanged(object sender,EventArgs e) {if(!IsDisposed && IsHandleCreated)BeginInvoke((Action)Clamp);}
  void Clamp() {var area=Screen.FromRectangle(Bounds).WorkingArea;Location=new Point(Math.Max(area.Left,Math.Min(Left,area.Right-Width)),Math.Max(area.Top,Math.Min(Top,area.Bottom-Height)));}
  protected override bool ShowWithoutActivation {get{return true;}}
  protected override void OnShown(EventArgs e) {
   base.OnShown(e);var failures=new List<string>();
   for(int i=1;i<=3;i++)if(RegisterHotKey(Handle,i,0x4000|1|2|4,(uint)(0x30+i)))registered.Add(i);else failures.Add(i.ToString()+" (Windows error "+Marshal.GetLastWin32Error()+")");
   if(RegisterHotKey(Handle,7,0x4000|1|2|4,0x23))registered.Add(7);else failures.Add("End (Start alternative; Windows error "+Marshal.GetLastWin32Error()+")");
   if(RegisterHotKey(Handle,8,0x4000|1|2|4,0x61))registered.Add(8);else failures.Add("Numpad 1 (Start alternative; Windows error "+Marshal.GetLastWin32Error()+")");
   if(RegisterHotKey(Handle,9,0x4000|1|2|4,0x28))registered.Add(9);else failures.Add("Down (Stop / picker next; Windows error "+Marshal.GetLastWin32Error()+")");
   if(RegisterHotKey(Handle,10,0x4000|1|2|4,0x62))registered.Add(10);else failures.Add("Numpad 2 (Stop alternative; Windows error "+Marshal.GetLastWin32Error()+")");
   if(smoke) {BeginInvoke((Action)Smoke);return;}
   BeginSync();
   if(failures.Count>0)MessageBox.Show(this,"These shortcuts are already in use or unavailable: "+String.Join(", ",failures)+". Use the tray menu for those actions.","OR Timer shortcuts",MessageBoxButtons.OK,MessageBoxIcon.Warning);
   if(store.Warning!=null)MessageBox.Show(this,store.Warning,"OR Timer recovery",MessageBoxButtons.OK,MessageBoxIcon.Warning);
  }
  void BeginSync() {if(smoke)return;if(syncWorker.IsBusy){syncAgain=true;return;}nextSync=DateTime.UtcNow.AddSeconds(30);try{syncStatus.Text="Sync: uploading history...";syncWorker.RunWorkerAsync(Store.Copy(state));}catch(Exception error){syncStatus.Text="Sync: retry pending";syncStatus.ToolTipText=error.Message;}}
  void Act(int action) {
   if(prompting)return;
   string name="Smoke test";
   if(action==1 && state.CurrentSession==null && !smoke) {
    prompting=true;
    try {using(var dialog=new NameDialog(true)){activePicker=dialog;try{if(dialog.ShowDialog(this)!=DialogResult.OK)return;name=dialog.AnesthetistName;}finally{activePicker=null;}}}finally{prompting=false;}
   }
   try {var next=Store.Copy(state);if(next.Apply(action,DateTime.UtcNow.Ticks,name)){store.Save(next);state=next;Invalidate();BeginSync();}}
   catch(Exception e){if(smoke)throw;MessageBox.Show(this,"The action was NOT applied because it could not be saved. The previous timer is still running.\n\n"+e.Message,"OR Timer save failed",MessageBoxButtons.OK,MessageBoxIcon.Error);}
  }
  protected override void WndProc(ref Message m) {if(m.Msg==0x0312){int id=m.WParam.ToInt32();if(id==9 || id==10){if(activePicker!=null && !activePicker.IsDisposed)activePicker.HandleSharedDown();else Act(2);}else Act(id==7 || id==8?1:id);return;}base.WndProc(ref m);}
  static string Duration(long seconds) {return String.Format(CultureInfo.InvariantCulture,"{0:00}:{1:00}:{2:00}",seconds/3600,(seconds/60)%60,seconds%60);}
  protected override void OnPaint(PaintEventArgs e) {
   base.OnPaint(e);long now=DateTime.UtcNow.Ticks;DrawRow(e.Graphics,"SURGERY",Duration(state.SurgerySeconds(now)),state.Phase=="surgery",Color.FromArgb(115,226,151),1);DrawRow(e.Graphics,"TURNOVER",Duration(state.TurnoverSeconds(now)),state.Phase=="turnover",Color.FromArgb(255,201,105),38);
   using(var pen=new Pen(Color.FromArgb(57,67,75))) {e.Graphics.DrawRectangle(pen,0,0,124,74);e.Graphics.DrawLine(pen,6,37,118,37);}
  }
  void DrawRow(Graphics g,string label,string duration,bool active,Color color,int y) {
   using(var brush=new SolidBrush(active?color:Color.FromArgb(153,165,174))) {g.FillEllipse(brush,8,y+5,5,5);g.DrawString(label,labelFont,brush,17,y+1,StringFormat.GenericTypographic);}
   using(var brush=new SolidBrush(active?color:Color.FromArgb(218,225,230)))g.DrawString(duration,timeFont,brush,7,y+13,StringFormat.GenericTypographic);
  }
  void Export() {using(var dialog=new SaveFileDialog {Filter="CSV files (*.csv)|*.csv",FileName="OR-Timer-"+DateTime.Now.ToString("yyyy-MM-dd")+".csv"})if(dialog.ShowDialog(this)==DialogResult.OK)try{File.WriteAllText(dialog.FileName,Store.Csv(state),new UTF8Encoding(true));}catch(Exception e){MessageBox.Show(this,e.Message,"Export failed");}}
  void Smoke() {
   try {
    NameDialog.VerifyPicker();
    using(var picker=new NameDialog(true)) {
     activePicker=picker;
     try {
      Exception pickerFailure=null;
      picker.Shown+=delegate{picker.BeginInvoke((Action)delegate{
       try {
        Tests.Check(picker.RegisteredShortcutCount==2,"picker shares Down with timer without shortcut conflict");
        SendMessage(Handle,0x0312,new IntPtr(9),IntPtr.Zero);
        Tests.Check(picker.AnesthetistName==".surgi - Dr. Chan" && state.Phase=="idle","Down navigates modal picker instead of stopping");
        SendMessage(Handle,0x0312,new IntPtr(10),IntPtr.Zero);
        Tests.Check(picker.AnesthetistName==".surgi - Dr. Taylor","numpad 2 navigates modal picker");
        using(var bmp=new Bitmap(picker.Width,picker.Height)){picker.DrawToBitmap(bmp,new Rectangle(0,0,picker.Width,picker.Height));bmp.Save(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"smoke-picker.png"));}
        SendMessage(picker.Handle,0x0312,new IntPtr(6),IntPtr.Zero);
       }catch(Exception error){pickerFailure=error;picker.Close();}
      });};
      var result=picker.ShowDialog(this);
      if(pickerFailure!=null)throw pickerFailure;
      Tests.Check(result==DialogResult.OK,"modal picker confirms after shared Down navigation");
     }finally{activePicker=null;}
    }
    Tests.Check(Width==125 && Height==75 && ClientSize==new Size(125,75),"125 x 75 window");Tests.Check(TopMost && !ShowInTaskbar && FormBorderStyle==FormBorderStyle.None,"window flags");Tests.Check(registered.Count==7,"all global shortcuts and Start/Stop alternatives registered");
    Tests.Check(Icon!=null && tray.Icon==trayIcon && trayIcon.Width==SystemInformation.SmallIconSize.Width,"custom executable and tray icon loaded");
    SendMessage(Handle,0x0312,new IntPtr(7),IntPtr.Zero);Tests.Check(state.Phase=="surgery" && state.CurrentSession.Cases.Count==1,"End-key Start alternative");
    SendMessage(Handle,0x0312,new IntPtr(8),IntPtr.Zero);Tests.Check(state.CurrentSession.Cases.Count==1,"Numpad Start alternative does not duplicate active case");
    SendMessage(Handle,0x0312,new IntPtr(1),IntPtr.Zero);Tests.Check(state.Phase=="surgery" && state.CurrentSession.Cases.Count==1,"original Start remains safe");
    using(var bmp=new Bitmap(125,75)){DrawToBitmap(bmp,new Rectangle(0,0,125,75));bmp.Save(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"smoke-surgery.png"));}
    SendMessage(Handle,0x0312,new IntPtr(9),IntPtr.Zero);Tests.Check(state.Phase=="turnover","Down stops surgery");
    SendMessage(Handle,0x0312,new IntPtr(2),IntPtr.Zero);Tests.Check(state.Phase=="turnover" && state.CurrentSession.Cases.Count==1,"original Stop remains safe");
    using(var bmp=new Bitmap(125,75)){DrawToBitmap(bmp,new Rectangle(0,0,125,75));bmp.Save(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"smoke-turnover.png"));}
    SendMessage(Handle,0x0312,new IntPtr(3),IntPtr.Zero);Tests.Check(state.Phase=="idle" && state.Sessions[0].End.HasValue,"end day message");
    SendMessage(Handle,0x0312,new IntPtr(8),IntPtr.Zero);Tests.Check(state.Phase=="surgery" && state.Sessions.Count==2,"Numpad 1 starts a new day");
    SendMessage(Handle,0x0312,new IntPtr(10),IntPtr.Zero);Tests.Check(state.Phase=="turnover","numpad 2 stops surgery");
    SendMessage(Handle,0x0312,new IntPtr(3),IntPtr.Zero);Tests.Check(state.Phase=="idle","new day finalized");
    File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"smoke-test-result.txt"),"PASS: seven global registrations, End/numpad Start, Down/numpad Stop, shared picker Down routing without conflict, original shortcuts, timer transitions and screenshots.");
   }catch(Exception e){Environment.ExitCode=1;File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"smoke-test-result.txt"),"FAIL: "+e);}
   finally{Close();}
  }
  protected override void Dispose(bool disposing) {if(disposing){Microsoft.Win32.SystemEvents.DisplaySettingsChanged-=DisplayChanged;foreach(int id in registered)UnregisterHotKey(Handle,id);clock.Dispose();tray.Visible=false;tray.Dispose();Icon=null;trayIcon.Dispose();windowIcon.Dispose();menu.Dispose();labelFont.Dispose();timeFont.Dispose();}base.Dispose(disposing);}
 }
 public static class Tests {
  public static void Check(bool ok,string name){if(!ok)throw new Exception("Failed: "+name);}
  public static void Run(string dir) {
   long t=new DateTime(2026,10,17,12,0,0,DateTimeKind.Utc).Ticks;long sec=TimeSpan.TicksPerSecond;var s=new TimerState();
   var precise=new TimerState();precise.Apply(1,t+9000);precise.Apply(2,t+sec+1000);Check(precise.CurrentCase.Start==t && precise.CurrentCase.End==t+sec && precise.SurgerySeconds(t+2*sec)==1,"sub-millisecond timestamps match JavaScript duration precision");
   Check(!s.Apply(2,t)&&!s.Apply(3,t),"idle actions are harmless");Check(s.Apply(1,t),"start");Check(!s.Apply(1,t+sec),"duplicate start");Check(s.SurgerySeconds(t+61*sec)==61,"elapsed");
   Check(s.Apply(2,t+120*sec),"end");Check(!s.Apply(2,t+125*sec),"duplicate end");Check(s.SurgerySeconds(t+130*sec)==120 && s.TurnoverSeconds(t+130*sec)==10,"both durations");
   var store=new Store(dir);store.Save(s);s=store.Load();Check(s.Phase=="turnover" && s.TurnoverSeconds(t+150*sec)==30,"restart resumes");
   Check(s.Apply(1,t+180*sec),"next case");Check(s.CurrentSession.Cases[0].TurnoverEnd==t+180*sec,"turnover finalized");Check(s.Apply(3,t+240*sec),"endday during surgery");Check(s.Sessions[0].Cases[1].End==t+240*sec && !s.Sessions[0].Cases[1].TurnoverEnd.HasValue,"end day preserves final surgery");Check(!s.Apply(3,t+250*sec),"duplicate end day");
   Check(s.Apply(1,t+300*sec) && s.Sessions.Count==2,"new session");s.Apply(2,t+360*sec);s.Apply(3,t+390*sec);Check(s.Sessions[1].Cases[0].TurnoverEnd==t+390*sec,"end day during turnover");
   SyncTests.Run(s);
   string csv=Store.Csv(s);Check(csv.Contains(",120,") && csv.Contains(",30\r\n") && csv.Split('\n').Length==5,"CSV history values");store.Save(s);Check(store.Load().Sessions.Count==2,"atomic replacement");
   File.WriteAllText(store.PathName,"broken");var recovery=new Store(dir);Check(recovery.Load().Phase=="turnover" && recovery.Warning!=null,"backup recovery");Check(Directory.GetFiles(dir,"*.corrupt-*").Length==1,"corrupt file preserved");
   File.WriteAllText(store.PathName,"broken");File.WriteAllText(store.PathName+".bak","broken too");bool failed=false;try{store.Load();}catch(InvalidDataException){failed=true;}Check(failed && File.ReadAllText(store.PathName)=="broken","both corrupt fail without overwrite");
  }
 }
 static class Program {
  [DllImport("user32.dll")]static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")]static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  static void EnableDpi(){try{if(SetProcessDpiAwarenessContext(new IntPtr(-4)))return;}catch(EntryPointNotFoundException){}SetProcessDPIAware();}
  [STAThread]static void Main(string[] args) {
   bool self=Array.IndexOf(args,"--self-test")>=0,smoke=Array.IndexOf(args,"--smoke-test")>=0,picker=Array.IndexOf(args,"--picker-smoke-test")>=0;string temporary=null;
   try {
    if(self || smoke)temporary=Path.Combine(Path.GetTempPath(),"OR-Timer-Test-"+Guid.NewGuid().ToString("N"));
    if(self) {Tests.Run(temporary);File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"self-test-result.txt"),"PASS: deterministic transitions, repeated actions, durations, restart, day archival, CSV, atomic replacement, corruption recovery, mock sync ordering, acknowledgments, offline retry and identity checks.");return;}
    if(picker){EnableDpi();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);bool foregroundVerified=NameDialog.VerifyGlobalPicker();File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"picker-smoke-test-result.txt"),"PASS: picker selection guards and boundaries, three global picker registrations, WM_HOTKEY navigation and confirmation while picker is not foreground, shortcuts released after closing. "+(foregroundVerified?"Foreground window remained unchanged during navigation.":"LIMITATION: foreground desktop unavailable (GetForegroundWindow returned 0); another foreground app could not be verified.")+" No system keyboard injection or production data access.");return;}
    bool first;using(var mutex=new Mutex(true,smoke?"Local\\OR-Timer-Smoke-"+Guid.NewGuid():"Local\\OR-Timer-Desktop-v1",out first)) {
     if(!first){MessageBox.Show("OR Timer is already running. Use its system tray icon.","OR Timer");return;}
     EnableDpi();Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
     Application.Run(new TimerWindow(new Store(temporary??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"OR Timer")),smoke));
    }
   }catch(Exception e){Environment.ExitCode=1;if(self||smoke||picker)File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,self?"self-test-result.txt":picker?"picker-smoke-test-result.txt":"smoke-test-result.txt"),"FAIL: "+e);else MessageBox.Show(e.Message,"OR Timer could not start",MessageBoxButtons.OK,MessageBoxIcon.Error);}
   finally {if(temporary!=null && Directory.Exists(temporary))Directory.Delete(temporary,true);}
  }
 }
}
