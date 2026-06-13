$src = "C:\Users\Meghansh Agarwal\Downloads\Expense Calc"
$dest = "C:\Users\Meghansh Agarwal\Documents\Expense Calc"

if (!(Test-Path $dest)) {
    New-Item -ItemType Directory -Force -Path $dest
}

Get-ChildItem -Path $src | Where-Object { $_.Name -notmatch '^\.(git|next|env\.local|ps1)$' -and $_.Name -ne 'node_modules' } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
}
