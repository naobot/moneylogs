type IconProps = {
  type: IconType
}

export type IconType = 'home' | 'question' | 'warning' | 'notification' | 'clock' | 'exit' | 'location' | 'dollar' | 'exit' | 'document'

const Icon = ({ type }: IconProps) => {
  const iconSet = type === 'exit' || type === 'document' ? 'reandra-khansa' : 'nakals'

  return (
    <div className="Icon">
      <img src={`/icons/${iconSet}-${type}.svg`} />
    </div>
  )
}

export default Icon