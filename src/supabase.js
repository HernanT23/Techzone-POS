import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';

export const supabase = createClient(SB_URL, SB_KEY);
