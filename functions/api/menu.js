/**
 * CLOUDFLARE PAGES SERVERLESS EDGE FUNCTION (/api/menu)
 * Reads SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_KEY) directly
 * from Cloudflare Environment Variables so nothing is hardcoded in the client code.
 */
export async function onRequestGet(context) {
  const { env } = context;

  const supabaseUrl = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const supabaseKey = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ error: 'Cloudflare environment variables SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not configured.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const headers = {
      'apikey': supabaseKey
    };
    if (supabaseKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${supabaseKey}`;
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/menu_items?select=*&order=sort_order.asc`,
      { headers }
    );

    if (!res.ok) {
      const errText = await res.text();
      return new Response(errText || 'Failed to retrieve menu from Supabase.', {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const items = await res.json();
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve menu from server.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
