export function mapApartmentRow(row, images = []) {
  if (!row) return null;
  const galleryUrls = Array.isArray(images) ? images.filter(Boolean) : [];
  const fallback = row.image_url ? [row.image_url] : [];
  return {
    id: row.id,
    catalog_number: row.catalog_number,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    location: row.location,
    address: row.address,
    property_type: row.property_type,
    rental_period: row.rental_period,
    price_per_night: Number(row.price_per_night),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    max_guests: row.max_guests,
    rating: row.rating != null ? Number(row.rating) : 4.5,
    is_available: Boolean(row.is_available),
    status: row.status,
    rejection_reason: row.rejection_reason,
    approved_at: row.approved_at,
    image: galleryUrls[0] || row.image_url,
    images: galleryUrls.length > 0 ? galleryUrls : fallback,
    owner_name: row.owner_name,
    owner_phone: row.owner_phone,
    owner_email: row.owner_email,
    contact_via_whatsapp: Boolean(row.contact_via_whatsapp),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const APARTMENT_EDITABLE_FIELDS = [
  'title',
  'description',
  'location',
  'address',
  'property_type',
  'rental_period',
  'price_per_night',
  'bedrooms',
  'bathrooms',
  'max_guests',
  'image_url',
  'owner_name',
  'owner_phone',
  'owner_email',
  'contact_via_whatsapp',
  'is_available',
];
