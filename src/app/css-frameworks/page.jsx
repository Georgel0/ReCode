import CssFrameworkConverter from './CssFrameworkConverter';
import { ToolFooter } from '@/components/layout';
import { getToolContent } from '@/lib/content';

export const metadata = {
 title: 'CSS Converter',
 description: 'Automatically convert raw CSS into utility classes for modern frameworks.',
};

export default function Page() {
 const footerContent = getToolContent('css-converter');
 
 return (
  <>
   <CssFrameworkConverter />
   
   <ToolFooter content={footerContent} />
  </>
 );
}