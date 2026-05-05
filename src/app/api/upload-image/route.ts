// ============================================================
// SiteSync — /api/upload-image
// Accepts a multipart form upload, stores in Supabase Storage,
// and returns the public URL.
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const BUCKET = 'site-assets'
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_SIZE_MB = 8

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const siteId = formData.get('siteId') as string | null
    const userId = formData.get('userId') as string | null

    if (!file || !siteId || !userId) {
      return NextResponse.json({ error: 'Missing file, siteId, or userId' }, { status: 400 })
    }

    // ── Validate type ─────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type not allowed. Accepted: JPEG, PNG, WebP, GIF, SVG` }, { status: 400 })
    }

    // ── Validate size ─────────────────────────────────────────
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large. Maximum size is ${MAX_SIZE_MB}MB` }, { status: 400 })
    }

    // ── Verify the user owns this site ───────────────────────
    const { data: site } = await supabaseAdmin
      .from('sites')
      .select('id, owner_id')
      .eq('id', siteId)
      .single()

    if (!site || site.owner_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // ── Ensure bucket exists ──────────────────────────────────
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    if (!buckets?.find(b => b.name === BUCKET)) {
      const { error: bucketErr } = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE_MB * 1024 * 1024,
        allowedMimeTypes: ALLOWED_TYPES,
      })
      if (bucketErr) {
        console.error('Bucket creation error:', bucketErr)
        return NextResponse.json({ error: 'Storage not available. Please contact support.' }, { status: 500 })
      }
    }

    // ── Build a safe filename ──────────────────────────────────
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 60)
    const timestamp = Date.now()
    const path = `${siteId}/${safeName}-${timestamp}.${ext}`

    // ── Upload ────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
    }

    // ── Return public URL ─────────────────────────────────────
    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({ url: urlData.publicUrl, path })
  } catch (err) {
    console.error('/api/upload-image error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
