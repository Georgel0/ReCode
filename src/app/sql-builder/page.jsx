import SqlBuilder from './SqlBuilder';

export const metadata = {
  title: 'SQL Builder',
  description: 'Convert plain English instructions into complex, optimized SQL queries.',
};

export default function Page() {
  return <SqlBuilder />;
}