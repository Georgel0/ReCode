import CodeAnalysis from './CodeAnalysis';
import ToolFooter from '@/components/ToolFooter'; 
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
  title: 'Code Analysis',
  description: 'Get an overall analysis of your code, prevent bugs, performance issues and security problems with our AI code auditor.',
};

export default function Page() {
  const footerContent = getToolContent('code-analysis');

  return (
   <>
    <CodeAnalysis />
      
    <ToolFooter content={footerContent} />
   </>
  );
}