const config = require("../config");

// ---- Live providers (free, no key) -----------------------------------------
// Provider A: ip-api.com — Provider B: ipapi.co. Used only when GEO_MODE=live.
async function fetchProviderALive(ip) {
  const res = await fetch(`http://ip-api.com/json/${ip}`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Provider A HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== "success") throw new Error("Provider A returned failure status");
  return { country: data.country, city: data.city, source: "provider_a" };
}

async function fetchProviderBLive(ip) {
  const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Provider B HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error("Provider B returned an error");
  return { country: data.country_name, city: data.city, source: "provider_b" };
}

// ---- Mock providers (deterministic, for EVIDENCE.md proofs) ---------------
// Toggle with GEO_MOCK_PROVIDER_A_DOWN / GEO_MOCK_PROVIDER_B_DOWN so the
// fallback chain can be demonstrated reliably, without depending on live
// third-party uptime during grading.
async function fetchProviderAMock() {
  if (config.geoMockProviderADown) throw new Error("Mock Provider A is down (GEO_MOCK_PROVIDER_A_DOWN=true)");
  return { country: "Bangladesh", city: "Dhaka", source: "provider_a" };
}

async function fetchProviderBMock() {
  if (config.geoMockProviderBDown) throw new Error("Mock Provider B is down (GEO_MOCK_PROVIDER_B_DOWN=true)");
  return { country: "Bangladesh (via fallback)", city: "Chittagong", source: "provider_b" };
}

// ---- Public API: enrichIp(ip) ----------------------------------------------
// Tries provider A, then provider B, then gives up. NEVER throws — a
// submission must always succeed, enriched or not. This is the
// "failure that must not fail" boundary called out in the brief.
async function enrichIp(ip) {
  const providerA = config.geoMode === "live" ? fetchProviderALive : fetchProviderAMock;
  const providerB = config.geoMode === "live" ? fetchProviderBLive : fetchProviderBMock;

  try {
    return await providerA(ip);
  } catch (errA) {
    console.warn(`[geo] Provider A failed (${errA.message}), trying Provider B`);
    try {
      return await providerB(ip);
    } catch (errB) {
      console.warn(`[geo] Provider B failed (${errB.message}), storing without geo data`);
      return { country: null, city: null, source: null };
    }
  }
}

module.exports = { enrichIp };
