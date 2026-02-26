import CodeGenerator from './CodeGenerator';
import ToolFooter from '@/components/UIComponents/ToolFooter';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
 title: 'Code Generator',
 description: 'Generate small to big code snippets, components, styles and more.',
};

export default function Page() {
 const footerContent = getToolContent('code-generator');
 
 return (
  <>
   <CodeGenerator />
  
   <ToolFooter content={footerContent} />
  </>
 );
}