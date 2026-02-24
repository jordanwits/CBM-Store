/**
 * Generate a tracking URL for a given tracking number
 * Attempts to detect the carrier and generate the appropriate tracking URL
 * Falls back to a universal tracking service if carrier cannot be detected
 */
export function getTrackingUrl(trackingNumber: string): string {
  if (!trackingNumber || !trackingNumber.trim()) {
    return '#';
  }

  const trimmed = trackingNumber.trim().toUpperCase();

  // UPS: Usually starts with "1Z" followed by 16 characters (alphanumeric)
  if (trimmed.startsWith('1Z') && trimmed.length === 18) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(trimmed)}`;
  }

  // FedEx: Usually 12 digits, or alphanumeric patterns
  // Common patterns: 12 digits, or starts with specific prefixes
  if (/^\d{12}$/.test(trimmed) || /^[0-9]{12}$/.test(trimmed)) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trimmed)}`;
  }
  // FedEx alphanumeric (e.g., 123456789012 or 123456789012345)
  if (/^[0-9]{12,15}$/.test(trimmed)) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trimmed)}`;
  }

  // USPS: Usually 20+ digits, or specific formats like 9400 1000 0000 0000 0000 00
  // Also handles formats like 9405511899223197428497
  if (/^\d{20,}$/.test(trimmed) || /^94\d{18}$/.test(trimmed)) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trimmed)}`;
  }
  // USPS with spaces (e.g., "9400 1000 0000 0000 0000 00")
  if (/^94\d{2}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{4}\s+\d{2}$/.test(trimmed)) {
    const cleaned = trimmed.replace(/\s+/g, '');
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(cleaned)}`;
  }

  // DHL: Various formats, often starts with specific prefixes or is 10-11 digits
  if (/^[0-9]{10,11}$/.test(trimmed) && !trimmed.startsWith('94')) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trimmed)}`;
  }

  // Fallback: Use universal tracking service that auto-detects carrier
  // 17track.net is a popular universal tracking service
  return `https://t.17track.net/en#nums=${encodeURIComponent(trimmed)}`;
}
