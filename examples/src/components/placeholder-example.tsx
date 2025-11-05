export default function PlaceholderExample({
  title,
  features,
}: {
  title: string;
  features: string;
}) {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div role="alert" className="alert alert-warning">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>This example is still under construction</span>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>

      {/* Feature List */}
      <ul className="space-y-2 list-disc list-inside">
        {features
          .split("\n")
          .filter((feature) => feature.trim())
          .map((feature, index) => (
            <li key={index}>{feature}</li>
          ))}
      </ul>
    </div>
  );
}
