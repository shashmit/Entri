export function Placeholder({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="text-center px-5 py-[70px]">
      <p className="text-[34px] mb-3.5">{icon}</p>
      <h2 className="font-display font-semibold text-2xl">{title}</h2>
      <p className="text-muted text-[14.5px] max-w-[38ch] mx-auto mt-2">{body}</p>
    </div>
  );
}
