interface ErrorMessageProps {
  message: string;
}

function ErrorMessage({ message }: ErrorMessageProps): JSX.Element {
  return (
    <div className="mb-2 p-2 bg-red-100 text-red-700 rounded">{message}</div>
  );
}

export default ErrorMessage;
