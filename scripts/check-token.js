/**
 * Script to check a specific invitation token
 * Run with: node scripts/check-token.js <token>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const token = process.argv[2] || 'B2vwXuZeUqmSbJD6CtbWGgEXBcmMOYWDxxVKIWZCFxI';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);
console.log('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkToken() {
  console.log(`🔍 Checking invitation token: ${token}\n`);
  
  // Check if ANY invitation exists with this token
  const { data: anyInvitation, error: anyError } = await supabase
    .from('project_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (anyError) {
    console.error('❌ Error fetching invitation:', anyError);
    return;
  }

  if (!anyInvitation) {
    console.log('❌ No invitation found with this token in database');
    return;
  }

  console.log('✅ Found invitation:');
  console.log(JSON.stringify(anyInvitation, null, 2));
  console.log('');

  // Now try to fetch with project details
  const { data: fullInvitation, error: fullError } = await supabase
    .from('project_invitations')
    .select(`
      *,
      projects (
        id,
        name,
        description
      ),
      profiles:created_by (
        full_name
      )
    `)
    .eq('token', token)
    .maybeSingle();

  if (fullError) {
    console.error('❌ Error fetching full invitation:', fullError);
    return;
  }

  if (fullInvitation) {
    console.log('✅ Full invitation with relations:');
    console.log(JSON.stringify(fullInvitation, null, 2));
  }
}

checkToken().catch(console.error);
