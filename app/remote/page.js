"use client";

import { useEffect, useState, useRef } from "react";

export default function SonyRemotePage() {
  const [step, setStep] = useState("search"); // "search" | "pair" | "remote"
  const [ip, setIp] = useState("");
  const [pin, setPin] = useState("");
  const [psk, setPsk] = useState("");
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");

  const recognitionRef = useRef(null);

  // Load saved credentials from localStorage on startup
  useEffect(() => {
    const savedIp = localStorage.getItem("sony_tv_ip");
    const savedPin = localStorage.getItem("sony_tv_pin");
    const savedPsk = localStorage.getItem("sony_tv_psk");

    if (savedIp && (savedPin || savedPsk)) {
      setIp(savedIp);
      if (savedPin) setPin(savedPin);
      if (savedPsk) setPsk(savedPsk);
      setStep("remote");
    } else {
      searchDevices();
    }
  }, []);

  // Search Sony TVs via SSDP
  async function searchDevices() {
    setIsSearching(true);
    setErrorMessage("");
    setStatusMessage("Scanning local network for Sony Bravia TVs…");

    try {
      const res = await fetch("/api/sony/discover");
      const data = await res.json();
      setDiscoveredDevices(data.devices || []);
      if ((data.devices || []).length === 0) {
        setStatusMessage("No TV found automatically. You can enter the TV IP address manually below.");
      } else {
        setStatusMessage(`Found ${data.devices.length} Sony TV(s). Select one below.`);
      }
    } catch (err) {
      setErrorMessage("Discovery error: " + err.message);
    } finally {
      setIsSearching(false);
    }
  }

  // Request pairing PIN from TV
  async function initiatePairing(targetIp) {
    const selectedIp = targetIp || ip;
    if (!selectedIp) {
      setErrorMessage("Please enter or select a valid TV IP address.");
      return;
    }

    setIp(selectedIp);
    setErrorMessage("");
    setStatusMessage("Connecting to TV… Look at your TV screen for a 4-digit PIN code.");

    try {
      const res = await fetch("/api/sony/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: selectedIp, action: "request_code" }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to trigger pairing on TV");

      setStep("pair");
      setStatusMessage("Pairing code requested! Please type the 4-digit code shown on your TV.");
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  // Verify PIN
  async function verifyPin(e) {
    e.preventDefault();
    if (!pin) {
      setErrorMessage("Please enter the 4-digit PIN.");
      return;
    }

    setErrorMessage("");
    setStatusMessage("Verifying PIN with TV…");

    try {
      const res = await fetch("/api/sony/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, pin, action: "verify_pin" }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Pairing failed. Incorrect code.");

      // Save to localStorage for instant reuse
      localStorage.setItem("sony_tv_ip", ip);
      localStorage.setItem("sony_tv_pin", pin);

      setStep("remote");
      setStatusMessage("Connected successfully!");
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  // Bypass pairing using Pre-Shared Key (Optional mode)
  function handleUsePsk(e) {
    e.preventDefault();
    if (!ip || !psk) {
      setErrorMessage("Please enter both TV IP and Pre-Shared Key.");
      return;
    }
    localStorage.setItem("sony_tv_ip", ip);
    localStorage.setItem("sony_tv_psk", psk);
    setStep("remote");
    setStatusMessage("Connected using Pre-Shared Key!");
  }

  // Send Remote Control Command
  async function sendCommand(command) {
    setErrorMessage("");
    try {
      const res = await fetch("/api/sony/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, pin, psk, command }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed command ${command}`);
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  // Voice Recognition Control
  function toggleVoiceControl() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceText("Listening… Say: 'Up', 'Down', 'Left', 'Right', 'Select/Go', 'Volume Up', 'Volume Down', 'Mute'");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      setVoiceText(`Heard: "${transcript}"`);

      if (transcript.includes("up") && !transcript.includes("volume")) {
        sendCommand("Up");
      } else if (transcript.includes("down") && !transcript.includes("volume")) {
        sendCommand("Down");
      } else if (transcript.includes("left")) {
        sendCommand("Left");
      } else if (transcript.includes("right")) {
        sendCommand("Right");
      } else if (transcript.includes("go") || transcript.includes("enter") || transcript.includes("select") || transcript.includes("ok") || transcript.includes("in")) {
        sendCommand("Confirm");
      } else if (transcript.includes("volume up") || transcript.includes("louder") || transcript.includes("increase volume")) {
        sendCommand("VolumeUp");
      } else if (transcript.includes("volume down") || transcript.includes("quieter") || transcript.includes("decrease volume")) {
        sendCommand("VolumeDown");
      } else if (transcript.includes("mute") || transcript.includes("unmute")) {
        sendCommand("Mute");
      } else if (transcript.includes("home")) {
        sendCommand("Home");
      } else if (transcript.includes("back") || transcript.includes("return")) {
        sendCommand("Return");
      } else if (transcript.includes("power") || transcript.includes("turn off")) {
        sendCommand("Power");
      } else {
        setVoiceText(`Unrecognized command: "${transcript}"`);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setVoiceText(`Voice error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function resetConnection() {
    localStorage.removeItem("sony_tv_ip");
    localStorage.removeItem("sony_tv_pin");
    localStorage.removeItem("sony_tv_psk");
    setPin("");
    setPsk("");
    setStep("search");
    setStatusMessage("");
    setErrorMessage("");
    searchDevices();
  }

  return (
    <div style={{ maxWidth: "520px", margin: "0 auto" }}>
      <h1>Sony Bravia Remote</h1>

      {statusMessage && (
        <div className="card good" style={{ background: "#ecfdf5", padding: "10px 14px", fontSize: "14px" }}>
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="card bad" style={{ background: "#fef2f2", padding: "10px 14px", fontSize: "14px" }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* --- STEP 1: SEARCH / SELECT TV --- */}
      {step === "search" && (
        <div className="card">
          <h3>1. Find Sony TV</h3>
          <p className="muted" style={{ fontSize: "13px" }}>
            Make sure your TV is turned ON and connected to the same Wi-Fi network.
          </p>

          <button onClick={searchDevices} disabled={isSearching} style={{ marginBottom: "14px" }}>
            {isSearching ? "Searching Network…" : "🔍 Scan Network for Sony TVs"}
          </button>

          {discoveredDevices.length > 0 && (
            <ul style={{ marginBottom: "16px" }}>
              {discoveredDevices.map((dev) => (
                <li key={dev.ip} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{dev.name}</strong>
                    <div className="muted" style={{ fontSize: "12px" }}>IP: {dev.ip}</div>
                  </div>
                  <button onClick={() => initiatePairing(dev.ip)}>Pair TV</button>
                </li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: "16px", borderTop: "1px dashed #d1d5db", paddingTop: "14px" }}>
            <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>Or Enter TV IP Manually:</h4>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="e.g. 192.168.1.100"
                value={ip}
                onChange={(e) => setIp(e.target.value.trim())}
                style={{ flex: 1 }}
              />
              <button onClick={() => initiatePairing(ip)}>Connect</button>
            </div>
          </div>

          <details style={{ marginTop: "16px", fontSize: "12px", color: "#4b5563" }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#2563eb" }}>
              Alternative: Use Pre-Shared Key (PSK)
            </summary>
            <form onSubmit={handleUsePsk} style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                type="text"
                placeholder="TV IP (e.g. 192.168.1.50)"
                value={ip}
                onChange={(e) => setIp(e.target.value.trim())}
                required
              />
              <input
                type="text"
                placeholder="Pre-Shared Key configured on TV (e.g. 0000)"
                value={psk}
                onChange={(e) => setPsk(e.target.value.trim())}
                required
              />
              <button type="submit" className="secondary">Connect with PSK</button>
            </form>
          </details>
        </div>
      )}

      {/* --- STEP 2: PAIRING PIN VERIFICATION --- */}
      {step === "pair" && (
        <div className="card">
          <h3>2. Enter Pairing Code</h3>
          <p style={{ fontSize: "14px" }}>
            A 4-digit code should now be visible on your Sony TV screen at <strong>{ip}</strong>.
          </p>
          <form onSubmit={verifyPin} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="text"
              placeholder="e.g. 1234"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.trim())}
              style={{ fontSize: "20px", textAlign: "center", letterSpacing: "4px", padding: "10px" }}
              required
              autoFocus
            />
            <button type="submit" style={{ padding: "12px", fontSize: "16px", fontWeight: "bold" }}>
              Confirm & Connect
            </button>
          </form>
          <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between" }}>
            <button className="secondary" type="button" onClick={() => initiatePairing(ip)}>
              Resend Code to TV
            </button>
            <button className="secondary" type="button" onClick={() => setStep("search")}>
              Change TV
            </button>
          </div>
        </div>
      )}

      {/* --- STEP 3: REMOTE CONTROL UI --- */}
      {step === "remote" && (
        <div className="remote-wrapper">
          <div className="remote-header">
            <div className="status-indicator">
              <span className="dot online"></span> Connected to {ip}
            </div>
            <button className="secondary small-btn" onClick={resetConnection}>
              Disconnect / Change TV
            </button>
          </div>

          <div className="remote-bezel">
            {/* Top Power & Source Buttons */}
            <div className="remote-top-row">
              <button className="round-btn danger-btn" onClick={() => sendCommand("Power")} title="Power">
                ⏻
              </button>
              <button
                className={`round-btn voice-btn ${isListening ? "listening" : ""}`}
                onClick={toggleVoiceControl}
                title="Voice Control"
              >
                🎙️
              </button>
              <button className="round-btn util-btn" onClick={() => sendCommand("Input")} title="Input Source">
                INPUT
              </button>
            </div>

            {/* Voice feedback badge */}
            {voiceText && (
              <div className="voice-status-box">
                {voiceText}
              </div>
            )}

            {/* --- D-PAD (Directional Arrows & Center OK/Go) --- */}
            <div className="dpad-container">
              <button className="dpad-btn dpad-up" onClick={() => sendCommand("Up")} title="Up Arrow">
                ▲
              </button>
              <button className="dpad-btn dpad-left" onClick={() => sendCommand("Left")} title="Left Arrow">
                ◀
              </button>
              <button className="dpad-center-btn" onClick={() => sendCommand("Confirm")} title="Center (Go / Enter)">
                GO
              </button>
              <button className="dpad-btn dpad-right" onClick={() => sendCommand("Right")} title="Right Arrow">
                ▶
              </button>
              <button className="dpad-btn dpad-down" onClick={() => sendCommand("Down")} title="Down Arrow">
                ▼
              </button>
            </div>

            {/* Navigation Helpers: Back & Home */}
            <div className="nav-actions-row">
              <button className="nav-pill-btn" onClick={() => sendCommand("Return")}>
                BACK
              </button>
              <button className="nav-pill-btn" onClick={() => sendCommand("Home")}>
                HOME
              </button>
            </div>

            {/* Volume Up / Down / Mute */}
            <div className="volume-control-box">
              <div className="vol-title">VOLUME</div>
              <div className="vol-buttons">
                <button className="vol-btn" onClick={() => sendCommand("VolumeUp")}>
                  +
                </button>
                <button className="vol-btn mute-btn" onClick={() => sendCommand("Mute")}>
                  MUTE
                </button>
                <button className="vol-btn" onClick={() => sendCommand("VolumeDown")}>
                  -
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
