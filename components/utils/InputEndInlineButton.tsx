import { useId } from 'react';
import { Check, SendHorizonalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InputEndInlineButtonProps {
    label: string;
    defaultValue?: string;
    placeholder?: string;
    handleChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    type?: 'text' | 'password' | 'email';
    activated?: boolean;
    isLoading?: boolean;
}

const InputEndInlineButton = ({
    label,
    defaultValue,
    placeholder,
    handleChange,
    handleClick,
    type = 'text',
    activated = false,
    isLoading = false
}: InputEndInlineButtonProps) => {
    const id = useId()

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
        }
    }

    return (
        <div className='w-full space-y-2'>
            <Label htmlFor={id}>{label}</Label>
            <div className='w-full flex items-center gap-x-2'>
                <div className='grow relative'>
                    <Input id={id} type={type} defaultValue={defaultValue} placeholder={placeholder} className='pr-9' onChange={handleChange} onKeyDown={handleKeyDown} disabled={activated} readOnly={activated || isLoading} />
                    <Button
                        variant='ghost'
                        size='icon'
                        className={`absolute inset-y-0 right-0 text-tangerine/80 focus-visible:ring-ring/50 rounded-l-none hover:text-tangerine hover:bg-transparent ${isLoading && 'text-stone-600 hover:text-stone-600'}`}
                        onClick={handleClick}
                        disabled={activated || isLoading}
                    >
                        {!activated &&
                            <SendHorizonalIcon />
                        }
                        <span className='sr-only'>Enter</span>
                    </Button>
                </div>
                {activated &&
                    <span className="text-sm text-green-600">
                        <Check />
                    </span>
                }
            </div>
        </div>
    )
}

export default InputEndInlineButton;