export default function JsonBlock({ value }: { value: any }) {
  return (
    <pre class="overflow-auto">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}
