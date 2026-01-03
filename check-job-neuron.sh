#!/bin/bash
JOB_ID="$1"

curl -s "https://udolfppdjnncwtqdoaat.supabase.co/rest/v1/simple_jobs?id=eq.${JOB_ID}&select=keyword,neuronwriter_data" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb2xmcHBkam5uY3d0cWRvYWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDg0MTksImV4cCI6MjA4MTQyNDQxOX0.B0r72aFqJxZELOwDu7X3lJEGc3M-6rAtDTTpZ6JpMmA" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkb2xmcHBkam5uY3d0cWRvYWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDg0MTksImV4cCI6MjA4MTQyNDQxOX0.B0r72aFqJxZELOwDu7X3lJEGc3M-6rAtDTTpZ6JpMmA"
