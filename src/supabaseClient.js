import {createClient} from '@supabase/supabase-js';

// A single auth client prevents competing session refresh listeners.
const endpoint=import.meta.env.VITE_SUPABASE_URL;
const publicKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase=endpoint&&publicKey?createClient(endpoint,publicKey):null;
