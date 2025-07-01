import cx from "classnames"
import { useRef, useState } from "react"

interface CopyTextAreaProps {
  value: string
  rows?: number
}

const CopyTextArea = ({ value, rows = 1 }: CopyTextAreaProps) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const [showCopiedMsg, setShowCopiedMsg] = useState(false)

  const handleClick = () => {
    if (textAreaRef.current) {
      textAreaRef.current.focus()
      textAreaRef.current.select()

      navigator.clipboard.writeText(value)
      setShowCopiedMsg(true)

      setTimeout(() => {
        setShowCopiedMsg(false)
      }, 1000)
    }
  }

  return (<div className="CopyTextArea">
    <textarea ref={textAreaRef} onClick={handleClick} value={value} rows={rows} readOnly />
    <div className={cx("CopyTextArea__block", { "CopyTextArea__block--hidden" : !showCopiedMsg })}>
      Copied!
    </div>
  </div>)
}

export default CopyTextArea