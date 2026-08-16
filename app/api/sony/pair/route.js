import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { ip, pin, action } = await request.json();

    if (!ip) {
      return NextResponse.json({ error: "TV IP address is required" }, { status: 400 });
    }

    const authHeaders = {
      "Content-Type": "application/json",
    };

    if (pin) {
      // Sony expects Basic Auth format ":<PIN>" encoded in base64
      const credentials = Buffer.from(`:${pin}`).toString("base64");
      authHeaders["Authorization"] = `Basic ${credentials}`;
    }

    const payload = {
      method: "actRegister",
      params: [
        {
          clientid: "SplitMoneyRemote:1",
          nickname: "NextJS Web Remote",
          level: "private",
        },
        [
          {
            value: "yes",
            function: "WOL",
          },
        ],
      ],
      id: 1,
      version: "1.0",
    };

    const targetUrl = `http://${ip}/sony/accessControl`;
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    // Step 1: Initial pairing request triggers the TV to display the PIN
    if (action === "request_code") {
      if (response.status === 401 || response.status === 200) {
        return NextResponse.json({
          success: true,
          message: "Pairing code requested. Check your TV screen.",
        });
      }
    }

    // Step 2: Verification of the PIN
    if (action === "verify_pin") {
      if (response.ok) {
        // 1. Capture the session cookie header from the TV
        const cookieHeader = response.headers.get("set-cookie");
        let tvCookie = "";

        // 2. Extract the specific 'auth=...' cookie string
        if (cookieHeader) {
          const match = cookieHeader.match(/(auth=[^;]+)/);
          if (match) tvCookie = match[1];
          else tvCookie = cookieHeader.split(';')[0]; // Fallback
        }

        return NextResponse.json({
          success: true,
          paired: true,
          cookie: tvCookie, // Send the extracted cookie to the frontend
          message: "Successfully paired with Sony TV!",
        });
      } else {
        return NextResponse.json(
          { error: "Invalid PIN code. Please re-enter the code on your TV screen." },
          { status: 401 }
        );
      }
    }

    return NextResponse.json({ success: response.ok });
  } catch (error) {
    return NextResponse.json(
      { error: `Connection failed: ${error.message}. Ensure TV is powered ON and on the same Wi-Fi.` },
      { status: 500 }
    );
  }
}

