import { useId } from 'react'
import { Check, SendHorizonalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface InputEndInlineButtonProps {
    label: string;
    placeholder?: string;
    handleChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    type?: 'text' | 'password' | 'email';
    activated?: boolean;
}

const InputEndInlineButton = ({ label, placeholder, handleChange, handleClick, type = 'text', activated = false }: InputEndInlineButtonProps) => {
    const id = useId()

    return (
        <div className='w-full space-y-2'>
            <Label htmlFor={id}>{label}</Label>
            <div className='w-full flex items-center gap-x-2'>
                <div className='grow relative'>
                    <Input id={id} type={type} placeholder={placeholder} className='pr-9' onChange={handleChange} disabled={activated} />
                    <Button
                        variant='ghost'
                        size='icon'
                        className='text-tangerine/80 focus-visible:ring-ring/50 absolute inset-y-0 right-0 rounded-l-none hover:text-tangerine hover:bg-transparent'
                        onClick={handleClick}
                        disabled={activated}
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