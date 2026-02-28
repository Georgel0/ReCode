import CodeConverter from './CodeConverter';
import { ToolFooter } from '@/components/layout';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
  title: 'Code Converter',
  description: 'Translate code between Python, JavaScript, Java, C++, and 15+ other languages.',
};

export default function Page() {
 const footerContent = getToolContent('code-converter');
 
 return (
  <>
   <CodeConverter />
   
   <ToolFooter content={footerContent} />
  </>
 );
}