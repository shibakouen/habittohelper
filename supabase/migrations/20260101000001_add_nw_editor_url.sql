-- Add NeuronWriter editor URL column to simple_blogs
ALTER TABLE simple_blogs ADD COLUMN IF NOT EXISTS neuronwriter_editor_url TEXT;
