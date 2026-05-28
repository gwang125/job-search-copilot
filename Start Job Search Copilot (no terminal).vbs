' Launches the app with a minimized PowerShell window (no need to type commands).
Set sh = CreateObject("WScript.Shell")
projectDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = projectDir
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File """ & projectDir & "\scripts\start-copilot.ps1""", 1, False
