const { createClient } = require('@supabase/supabase-js');

let client;
function getClient() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return client;
}

async function createSignedDownloadUrl(fileKey, expiresInSeconds = 60) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'digital-products';
  const { data, error } = await getClient().storage.from(bucket).createSignedUrl(fileKey, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

async function uploadToBucket(bucket, key, buffer, contentType) {
  const { error } = await getClient().storage.from(bucket).upload(key, buffer, { contentType, upsert: true });
  if (error) throw error;
}

function getPublicUrl(bucket, key) {
  const { data } = getClient().storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

async function deleteFromBucket(bucket, key) {
  await getClient().storage.from(bucket).remove([key]);
}

async function deliverableFileExists(fileKey) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'digital-products';
  const slash = fileKey.lastIndexOf('/');
  const folder = slash === -1 ? '' : fileKey.slice(0, slash);
  const name = slash === -1 ? fileKey : fileKey.slice(slash + 1);
  const { data, error } = await getClient().storage.from(bucket).list(folder, { search: name });
  if (error) return false;
  return (data || []).some((f) => f.name === name);
}

module.exports = { createSignedDownloadUrl, uploadToBucket, getPublicUrl, deleteFromBucket, deliverableFileExists };
