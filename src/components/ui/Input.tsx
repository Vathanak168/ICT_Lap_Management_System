import { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ElementType;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', icon: Icon, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-4 w-4 text-secondary-text" />
          </div>
        )}
        <input
          ref={ref}
          className={`
            block w-full rounded-lg leading-5 bg-white text-primary sm:text-sm transition-colors border
            focus:outline-none focus:ring-1 
            ${Icon ? 'pl-9 pr-3' : 'px-3'} 
            ${props.type === 'date' ? 'py-[7px]' : 'py-2'}
            ${error 
              ? 'border-danger focus:border-danger focus:ring-danger text-danger placeholder-red-300' 
              : 'border-border focus:border-primary focus:ring-primary placeholder-secondary-text'
            }
            ${className}
          `}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
