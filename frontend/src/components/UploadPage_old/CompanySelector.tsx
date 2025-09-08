interface CompanySelectorProps {
  companies: string[];
  selectedCompanies: string[];
  onToggle: (company: string) => void;
}

function CompanySelector(props: CompanySelectorProps) {
  const { companies, selectedCompanies, onToggle } = props;

  return (
    <div>
      <h4 className="text-md font-medium text-gray-700 mb-2 flex items-center">
        <span className="text-blue-500 mr-1">#</span> 회사
      </h4>
      <div className="flex flex-wrap gap-2">
        {companies.map((company) => (
          <button
            key={company}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              selectedCompanies.includes(company)
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => onToggle(company)}
          >
            {company}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CompanySelector;
