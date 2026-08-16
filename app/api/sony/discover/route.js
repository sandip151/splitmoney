import { NextResponse } from "next/server";
import dgram from "dgram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const discoveredDevices = new Map();

  const ssdpSearch = new Promise((resolve) => {
    const client = dgram.createSocket("udp4");
    const SSDP_PORT = 1900;
    const SSDP_ADDR = "239.255.255.250";

    const query = Buffer.from(
      "M-SEARCH * HTTP/1.1\r\n" +
      `HOST: ${SSDP_ADDR}:${SSDP_PORT}\r\n` +
      'MAN: "ssdp:discover"\r\n' +
      "MX: 2\r\n" +
      "ST: urn:schemas-sony-com:service:IRCC:1\r\n\r\n"
    );

    client.on("message", (msg, rinfo) => {
      const text = msg.toString();
      if (text.includes("sony") || text.includes("IRCC") || text.includes("scalarweb")) {
        discoveredDevices.set(rinfo.address, {
          ip: rinfo.address,
          name: `Sony TV (${rinfo.address})`,
        });
      }
    });

    client.on("error", () => {
      client.close();
      resolve();
    });

    client.bind(() => {
      client.send(query, 0, query.length, SSDP_PORT, SSDP_ADDR);
    });

    // Scan for 2.5 seconds
    setTimeout(() => {
      try {
        client.close();
      } catch {}
      resolve();
    }, 2500);
  });

  await ssdpSearch;

  return NextResponse.json({
    devices: Array.from(discoveredDevices.values()),
  });
}
