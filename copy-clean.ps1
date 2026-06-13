$src = "C:\Users\Meghansh Agarwal\Downloads\Expense Calc"
$dest = "C:\Users\Meghansh Agarwal\Documents\Expense Calc"

Get-ChildItem -Path $src -Recurse | Where-Object { $_.FullName -notmatch '\\(git|next|node_modules|copy-clean\.ps1|sync\.ps1)' } | ForEach-Object {
    $relativePath = $_.FullName.Substring($src.Length + 1)
    $targetPath = Join-Path $dest $relativePath
    if ($_.PsIsContainer) {
        if (!(Test-Path $targetPath)) {
            $null = New-Item -ItemType Directory -Path $targetPath -Force
        }
    } else {
        $parentDir = Split-Path $targetPath
        if (!(Test-Path $parentDir)) {
            $null = New-Item -ItemType Directory -Path $parentDir -Force
        }
        Copy-Item -Path $_.FullName -Destination $targetPath -Force
    }
}
