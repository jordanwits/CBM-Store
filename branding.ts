import { BrandingConfig } from 'core/components/BrandingProvider';

export const cbmBranding: BrandingConfig = {
  appName: 'CBM Store',
  logoText: 'CBM Plastics',
  logo: {
    src: '/cbmLogo.png',
    alt: 'CBM Plastics',
    width: 200,
    height: 200,
  },
  colors: {
    primary: '#00467F',
    primaryForeground: '#ffffff',
    secondary: '#00467F',
    secondaryForeground: '#ffffff',
  },
  support: {
    email: 'orders@cbmplasticsusa.com',
    phone: '217-543-3870',
    phoneDial: '+12175433870',
  },
  domain: 'cbm-plastics',
};
