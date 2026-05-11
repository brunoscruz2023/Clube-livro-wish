export const isInAppBrowser = () => {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return (
    ua.indexOf('FBAN') > -1 ||
    ua.indexOf('FBAV') > -1 ||
    ua.indexOf('Instagram') > -1 ||
    ua.indexOf('WhatsApp') > -1 ||
    ua.indexOf('Threads') > -1 ||
    ua.indexOf('Musicaly') > -1 || // TikTok
    ua.indexOf('TikTok') > -1 ||
    ua.indexOf('Snapchat') > -1 ||
    ua.indexOf('Twitter') > -1 ||
    ua.indexOf('Pinterest') > -1 ||
    ua.indexOf('LinkedInApp') > -1
  );
};

export const isAndroid = () => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.indexOf('android') > -1;
};

export const isIOS = () => {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
};

export const getExternalBrowserUrl = () => {
  const url = window.location.href;
  const noProtocol = url.replace(/^https?:\/\//, '');

  if (isAndroid()) {
    // Intent protocol for Android to force Chrome
    return `intent://${noProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
  }
  
  // For iOS there's no reliable universal protocol like Android's Intent,
  // but we can return the URL and instruct the user.
  return url;
};
