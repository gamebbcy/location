import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">页面不存在</h1>
        <p className="mt-2 text-sm text-muted-foreground">这个地址可能已失效或输入有误。</p>
        <Link
          to="/map"
          className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          返回地图
        </Link>
      </section>
    </main>
  );
};

export default NotFound;
