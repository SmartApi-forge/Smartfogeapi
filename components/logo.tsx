export const Logo = () => {
  return (
    <div className="flex items-center space-x-1.5 sm:space-x-2">
      {/* Logo icon - responsive size */}
      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
        <span className="text-primary-foreground font-bold text-xs sm:text-sm">SA</span>
      </div>
      {/* Logo text - responsive size and visibility */}
      <span className="font-semibold text-base sm:text-lg text-foreground whitespace-nowrap">
        <span className="hidden sm:inline">SmartAPIForge</span>
        <span className="sm:hidden">Smart API</span>
      </span>
    </div>
  )
}
