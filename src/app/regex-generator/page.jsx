import RegexGenerator from './RegexGenerator';
import { ToolFooter } from '@/components/layout';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
  title: 'Regex Generator',
  description: 'Create complex regular expressions by describing your matching patterns in natural language.',
};

export default function Page() {
  const footerContent = getToolContent('regex-generator');
  
  return (
   <>
    <RegexGenerator />
    
   <ToolFooter content={footerContent} />
  </>
 );
}