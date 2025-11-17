/**
 * Script to check invitations in the database
 * Run with: node scripts/check-invitations.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInvitations() {
  console.log('🔍 Checking invitations in database...\n');
  
  // Get all invitations
  const { data: invitations, error } = await supabase
    .from('project_invitations')
    .select(`
      id,
      email,
      token,
      status,
      access_level,
      expires_at,
      created_at,
      projects (
        name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching invitations:', error);
    return;
  }

  if (!invitations || invitations.length === 0) {
    console.log('📭 No invitations found in database');
    return;
  }

  console.log(`✅ Found ${invitations.length} invitation(s):\n`);
  
  invitations.forEach((inv, index) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite/${inv.token}`;
    
    console.log(`${index + 1}. Invitation for ${inv.email}`);
    console.log(`   Project: ${inv.projects?.name || 'Unknown'}`);
    console.log(`   Status: ${inv.status}`);
    console.log(`   Access Level: ${inv.access_level}`);
    console.log(`   Created: ${new Date(inv.created_at).toLocaleString()}`);
    console.log(`   Expires: ${inv.expires_at ? new Date(inv.expires_at).toLocaleString() : 'Never'}`);
    console.log(`   Link: ${inviteUrl}`);
    console.log('');
  });
}

checkInvitations().catch(console.error);
