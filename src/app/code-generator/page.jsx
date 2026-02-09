import CodeGenerator from './CodeGenerator';
import ToolFooter from '@/components/ToolFooter';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
 title: 'Code Generator',
 description: 'Generate small to big code snippets, components, styles and more.',
};

export default function Page() {
 const footerContent = getToolContent('code-analysis');
 
 return (
  <>
   <CodeGenerator />
  
   <ToolFooter content={footerContent} />
  </>
 );
}