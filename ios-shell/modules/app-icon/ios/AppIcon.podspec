Pod::Spec.new do |s|
  s.name           = 'AppIcon'
  s.version        = '0.1.0'
  s.summary        = 'App-Symbol wechseln (Wechsel-Symbole aus plugins/withAppIcons.js)'
  s.author         = 'TREKKING'
  s.homepage       = 'https://trek-king.pages.dev'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
