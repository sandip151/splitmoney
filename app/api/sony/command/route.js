import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Standard Sony Bravia IRCC Codes
const IRCC_CODES = {
  Up: "AAAAAQAAAAEAAAB0Aw==",
  Down: "AAAAAQAAAAEAAAB1Aw==",
  Left: "AAAAAQAAAAEAAAA0Aw==",  // Updated from B2Aw==
  Right: "AAAAAQAAAAEAAAAzAw==", // Updated from B3Aw==
  Confirm: "AAAAAQAAAAEAAABlAw==", // Center / Go / Enter button
  VolumeUp: "AAAAAQAAAAEAAAASAw==",
  VolumeDown: "AAAAAQAAAAEAAAATAw==",
  Mute: "AAAAAQAAAAEAAAAUAw==",
  Home: "AAAAAQAAAAEAAABgAw==",
  Return: "AAAAAQAAAAEAAABjAw==",
  Power: "AAAAAQAAAAEAAAAVAw==",
  Input: "AAAAAQAAAAEAAAAlAw==",
};

export async function POST(request) {
  try {
    // 1. Accept the cookie from the payload
    const { ip, pin, psk, cookie, command } = await request.json();

    if (!ip || !command) {
      return NextResponse.json({ error: "IP and Command are required" }, { status: 400 });
    }

    const irccCode = IRCC_CODES[command];
    if (!irccCode) {
      return NextResponse.json({ error: `Unknown command: ${command}` }, { status: 400 });
    }

    const soapEnvelope = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
      <IRCCCode>${irccCode}</IRCCCode>
    </u:X_SendIRCC>
  </s:Body>
</s:Envelope>`;

    const headers = {
      "Content-Type": "text/xml; charset=UTF-8",
      SOAPACTION: '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
    };

    // 2. Prioritize the new session Cookie!
    if (psk) {
      headers["X-Auth-PSK"] = psk;
    } else if (cookie) {
      headers["Cookie"] = cookie;
    } else if (pin) {
      const credentials = Buffer.from(`:${pin}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const response = await fetch(`http://${ip}/sony/ircc`, {
      method: "POST",
      headers,
      body: soapEnvelope,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `TV responded with HTTP status ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, command });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to send command: ${error.message}` },
      { status: 500 }
    );
  }
}

