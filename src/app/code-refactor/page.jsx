import CodeRefactor from './CodeRefactor';
import ToolFooter from '@/components/UIComponents/ToolFooter';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
 title: 'Code Refactor',
 description: 'Clean up technical debt, improve readability, and optimize your logic with AI.',
};

export default function Page() {
 const footerContent = getToolContent('code-refactor');
 
 return ( 
  <>
   <CodeRefactor />
   
   <ToolFooter content={footerContent} />
  </>
 );
}