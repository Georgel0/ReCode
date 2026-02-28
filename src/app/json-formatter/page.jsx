import JsonFormatter from './JsonFormatter';
import { ToolFooter } from '@/components/layout';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
 title: 'JSON Formatter',
 description: 'Format, validate, and use AI to fix structural errors in broken JSON strings.',
};

export default function Page() {
 const footerContent = getToolContent('json-formatter');
 
 return (
  <>
   <JsonFormatter />
   
   <ToolFooter content={footerContent} />
  </>
 );
}