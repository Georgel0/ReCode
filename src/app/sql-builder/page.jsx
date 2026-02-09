import SqlBuilder from './SqlBuilder';
import ToolFooter from '@/components/ToolFooter';
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
  title: 'SQL Builder',
  description: 'Convert plain English instructions into complex, optimized SQL queries.',
};

export default function Page() {
  const footerContent = getToolContent('sql-builder');
  
  return (
  <>
   <SqlBuilder />
    
   <ToolFooter content={footerContent} />
  </>
 );
}