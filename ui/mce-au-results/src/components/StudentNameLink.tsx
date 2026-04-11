import { Link } from "react-router-dom";

type StudentNameLinkProps = {
  regno: string;
  name: string;
};

export function StudentNameLink({ regno, name }: StudentNameLinkProps) {
  return (
    <Link
      to={`/student/${regno}`}
      className="student-name-link"
      title={`Open profile for ${name}`}
    >
      {name}
    </Link>
  );
}
