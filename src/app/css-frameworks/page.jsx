import CssFrameworkConverter from './CssFrameworkConverter';
import ToolFooter from '@/components/ToolFooter';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
 title: 'CSS Framework Converter',
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