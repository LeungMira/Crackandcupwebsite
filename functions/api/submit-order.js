/**
 * CLOUDFLARE PAGES SERVERLESS EDGE PROXY (/api/submit-order)
 * Hides SUPABASE_URL and SUPABASE_KEY in server-side Environment Variables
 * so they NEVER appear in Browser Developer Mode (F12 -> Sources / Network).
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const supabaseUrl = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const supabaseKey = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey) {
    return new Response('Server environment variables SUPABASE_URL / SUPABASE_KEY not configured.', { status: 500 });
  }

  try {
    const body = await request.json();

    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey
    };
    if (supabaseKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${supabaseKey}`;
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_order`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_customer_name: body.p_customer_name,
        p_phone: body.p_phone,
        p_social_handle: body.p_social_handle,
        p_fulfillment_mode: body.p_fulfillment_mode,
        p_payment_method: body.p_payment_method,
        p_location: body.p_location,
        p_landmark: body.p_landmark,
        p_items: body.p_items
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(data.message || 'Order rejected by database security rules.', { status: res.status });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response('Invalid order request.', { status: 400 });
  }
}
