/**
 * Browser detection utilities for handling platform-specific behavior
 */

/**
 * Detects if the user is on iOS (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad on iOS 13+ detection
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Detects if the user is on Safari browser
 */
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.indexOf('safari') !== -1 &&
    ua.indexOf('chrome') === -1 &&
    ua.indexOf('android') === -1
  );
}

/**
 * Detects if the user is on iOS Safari
 */
export function isIOSSafari(): boolean {
  return isIOS() && isSafari();
}

/**
 * Detects if the user is on a mobile device (iOS or Android)
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Detects if the device is likely a tablet
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  const isTabletUA = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua);
  
  // Also check screen size as a fallback
  const hasTabletScreen = window.innerWidth >= 768 && window.innerWidth <= 1024;
  
  return isTabletUA || hasTabletScreen;
}
