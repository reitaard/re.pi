# RePi Terminal Setup

RePi uses the Kitty keyboard protocol when the terminal supports it, then falls back to xterm `modifyOtherKeys`, then legacy input. Run `/tui-setup` inside RePi to report the active protocol and which canonical sequences RePi has observed.

RePi never edits terminal settings silently. `/tui-setup apply windows-terminal` and `/tui-setup apply vscode` show a proposed diff, ask for confirmation, create a timestamped backup, and only then write the file. The setup changes only terminal-focus forwarding for RePi's modified keys:

| Key | Sequence |
|---|---|
| Shift+Enter | CSI-u `\u001b[13;2u` |
| Alt+Enter | CSI-u `\u001b[13;3u` |
| Alt+Up | xterm modified arrow `\u001b[1;3A` |
| Ctrl+V | raw `\u0016` |
| Ctrl+Z | raw `\u001a` |

A terminal that cannot send distinct modified keys cannot be made universal by RePi. The report names each unconfirmed binding and points back to the opt-in setup command.

These mappings belong to the terminal application, not to the RePi process. After applying them, the listed shortcuts are forwarded this way in every focused terminal tab, including tabs running a normal shell or another TUI. In particular, Ctrl+V no longer invokes the terminal's normal paste action and Ctrl+Z is sent to the foreground program. Review the proposed diff before confirming.

## Windows Terminal

Run `/tui-setup apply windows-terminal`. RePi detects the packaged or unpackaged Windows Terminal `settings.json`, previews these `sendInput` actions, backs up the file, and applies them only after confirmation. Restart Windows Terminal if it does not reload the settings.

Manual validation in Windows Terminal:

1. Start RePi in a normal Windows Terminal tab.
2. Press Shift+Enter and confirm that a newline is inserted, not submitted.
3. Type a message, press Alt+Enter while a task is working, and confirm that it appears under **Follow-up**.
4. Press Alt+Up and confirm that queued text returns to the editor.
5. Type text, press Ctrl+Z, and confirm that the editor undoes the last edit rather than suspending RePi.
6. Press Ctrl+V with text or an image in the Windows clipboard and confirm that text is inserted or an image path is attached.
7. Run `/tui-setup` and confirm the protocol plus observed bindings.

Windows Terminal consumes some shortcuts by default, notably Alt+Enter fullscreen and often Ctrl+V paste. The opt-in setup is required when those host actions prevent RePi from receiving the key.

## VS Code Integrated Terminal

Run `/tui-setup apply vscode`. RePi detects the VS Code `keybindings.json`, previews `when: "terminalFocus"` `workbench.action.terminal.sendSequence` rules, backs up the file, and applies them only after confirmation. This is the supported way to prevent VS Code from consuming the keys while its integrated terminal is focused.

Manual validation in VS Code:

1. Open the integrated terminal and start RePi.
2. Repeat the Windows Terminal checks for Shift+Enter, Alt+Enter, Alt+Up, Ctrl+Z, and Ctrl+V.
3. Ensure the VS Code editor is not focused when testing; the rules intentionally apply only when `terminalFocus` is true.
4. Run `/tui-setup` and confirm each expected sequence.

Alt+Up is commonly intercepted by VS Code as terminal scroll/page movement. If it remains unconfirmed, use the setup flow and test again. Do not claim that Alt+Up works in VS Code merely because the shortcut is displayed.

## PowerShell

PowerShell does not decide whether RePi receives these sequences; the terminal host does. In Windows Terminal or VS Code Integrated Terminal, validate from the PowerShell prompt exactly as above. RePi's raw mode must receive raw Ctrl+V (`0x16`) and Ctrl+Z (`0x1a`) for those keys to reach the editor.

If a PowerShell host consumes a key before raw mode, run `/tui-setup` to inspect the report and use the host's explicit terminal-focus forwarding configuration. RePi will report the exact binding that remains unconfirmed.

## Bash

In Bash, RePi enters raw mode and Ctrl+V (`0x16`) is the canonical clipboard trigger. Ctrl+Z (`0x1a`) is editor undo while RePi is running; RePi deliberately has no default suspend binding. Shift+Enter and Alt+Enter require a terminal that sends the distinct CSI-u sequences or a host mapping to those sequences.

Validate from Bash by running RePi, testing each key, and then checking `/tui-setup`. Bash itself may provide no distinct modified-key sequence for older terminal emulators.

## WSL

Run RePi from WSL and validate the Linux-side terminal host, not only the WSL shell. Windows Terminal settings are configured on the Windows side, so use `/tui-setup apply windows-terminal` from a Windows RePi session or apply the same reviewed diff to the Windows Terminal settings file. WSL clipboard image support may use `wl-paste`, `xclip`, or PowerShell fallback; drag-and-drop remains a fallback when clipboard access or image decoding fails.

Confirm that Ctrl+Z undoes editor text in WSL. Do not expect Unix job-control suspension from RePi's default Ctrl+Z policy.

## SSH

SSH transports terminal bytes but cannot access the local keyboard. RePi can recognize a sequence sent by the remote terminal, but it cannot repair a local terminal configuration over SSH and cannot use a local modifier fallback. Configure the terminal on the machine where the keyboard is pressed, then run `/tui-setup` on the remote RePi session and confirm the observed sequences.

If the report shows legacy protocol or an unconfirmed binding, use a terminal or multiplexer that forwards CSI-u/modifyOtherKeys. RePi reports the exact failed binding instead of claiming universal support.

## Other terminals

Kitty, Ghostty, WezTerm, Alacritty, and iTerm2 may support the required protocols, but configuration and defaults vary by version. Use `/tui-setup` as the evidence source. RePi does not silently edit their files and does not claim support when a terminal cannot distinguish modified keys.

Terminals or IDE terminals that collapse Shift+Enter, Alt+Enter, Alt+Up, Ctrl+V, or Ctrl+Z into another byte cannot provide the canonical RePi behavior without an explicit host mapping.
