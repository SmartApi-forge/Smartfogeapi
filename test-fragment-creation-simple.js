// Simple test to verify fragment creation after the fix
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFragmentCreation() {
  console.log('Testing fragment creation after fix...');
  
  try {
    // Get current fragment count
    const { count: initialCount, error: countError } = await supabase
      .from('fragments')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error getting initial fragment count:', countError);
      return;
    }
    
    console.log(`Initial fragment count: ${initialCount}`);
    
    // Get the latest fragments to see current state
    const { data: latestFragments, error: latestError } = await supabase
      .from('fragments')
      .select('id, message_id, fragment_type, title, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (latestError) {
      console.error('Error getting latest fragments:', latestError);
      return;
    }
    
    console.log('Latest fragments:');
    latestFragments.forEach(fragment => {
      console.log(`- ID: ${fragment.id}, Type: ${fragment.fragment_type}, Title: ${fragment.title}, Created: ${fragment.created_at}`);
    });
    
    // Check messages without fragments
    const { data: messagesWithoutFragments, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id, 
        created_at,
        fragments!left(id)
      `)
      .is('fragments.id', null)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (messagesError) {
      console.error('Error getting messages without fragments:', messagesError);
      return;
    }
    
    console.log(`\nMessages without fragments: ${messagesWithoutFragments.length}`);
    messagesWithoutFragments.forEach(message => {
      console.log(`- Message ID: ${message.id}, Created: ${message.created_at}`);
    });
    
    // Check recent API fragments
    const { data: recentApiFragments, error: apiError } = await supabase
      .from('api_fragments')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (apiError) {
      console.error('Error getting recent API fragments:', apiError);
      return;
    }
    
    console.log('\nRecent API fragments:');
    recentApiFragments.forEach(apiFragment => {
      console.log(`- API Fragment ID: ${apiFragment.id}, Created: ${apiFragment.created_at}`);
    });
    
    console.log('\nTest completed. The fix should ensure future API generations create fragments consistently.');
    
  } catch (error) {
    console.error('Error during fragment creation test:', error);
  }
}

testFragmentCreation();